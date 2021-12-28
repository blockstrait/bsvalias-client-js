import { DnsServerResponseError } from './errors';

import { Request } from './request';

import {
  SrvResolver,
  SrvResolverResponse,
  DomainService,
} from './srv-resolver';

/**
 * Question returned by a DNS resolver.
 * @internal
 */
interface QueryQuestion {
  name: string;
  type: number;
}

/**
 * Resource record answer returned by a DNS resolver.
 * @internal
 */
interface ResourceRecordAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

/**
 * SRV resource record.
 * @internal
 */
interface SrvRecord {
  name: string;
  TTL: number;
  priority: number;
  weight: number;
  port: number;
  target: string;
}

/**
 * Response returned by a DNS resolver after receiving a query request.
 * @internal
 */
interface QueryResponse {
  Status: number;
  TC: boolean;
  RD: boolean;
  RA: boolean;
  AD: boolean;
  CD: boolean;
  Question: QueryQuestion[];
  Answer?: ResourceRecordAnswer[];
}

/**
 * Relevant error codes.
 * @internal
 */
const ErrorCodes = {
  NOERROR: 0,
  NXDOMAIN: 3,
};

/**
 * Relevant Resource Record types.
 * @internal
 */
const RecordTypes = {
  SRV: 33,
};

/** @internal */
const HOSTNAME = 'cloudflare-dns.com';

/** @internal */
const PATH = '/dns-query';

/**
 * Implementation of an SRV-cognizant client as described in RFC 2782.
 *
 * It uses Cloudflare's DNS over HTTPS endpoints using JSON formatted
 * queries, which are not standarised.
 */
export class DohSrvResolver extends SrvResolver {
  private request: Request;

  constructor() {
    super();

    this.request = new Request();
  }

  /** See {@link SrvResolver.locateServices}. */
  async locateServices(
    domainName: string,
    service: string,
    protocol: string
  ): Promise<SrvResolverResponse | null> {
    const queryName = `_${service}._${protocol}.${domainName}`;

    const dnsQuery: any = {
      name: queryName,
      type: 'SRV',
    };

    const dnsQueryString = Object.keys(dnsQuery)
      .map(key => `${key}=${dnsQuery[key]}`)
      .join('&');

    const response: QueryResponse = await this.request.get(
      `https://${HOSTNAME}${PATH}?${dnsQueryString}`,
      {
        accept: 'application/dns-json',
        'content-type': 'application/dns-json',
      }
    );

    const isDomainNonExistent = response.Status === ErrorCodes.NXDOMAIN;

    if (isDomainNonExistent) {
      return null;
    }

    if (response.Status !== ErrorCodes.NOERROR) {
      throw new DnsServerResponseError('Error response sent by the server');
    }

    if (!response.Question || !Array.isArray(response.Question)) {
      throw new DnsServerResponseError('No `Question` field found');
    }

    if (response.Question.length !== 1) {
      throw new DnsServerResponseError('Expected only one `Question` element');
    }

    const question = response.Question[0];

    const isNameValid = question.name && question.name === queryName;

    if (!isNameValid) {
      throw new DnsServerResponseError('Invalid question name');
    }

    const isTypeValid = question.type && question.type === RecordTypes.SRV;

    if (!isTypeValid) {
      throw new DnsServerResponseError('Invalid question type');
    }

    if (!response.Answer || !Array.isArray(response.Answer)) {
      return null;
    }

    const answers = response.Answer;

    const srvRecords: SrvRecord[] = answers
      .filter(
        (answer: ResourceRecordAnswer) =>
          answer.name === question.name && answer.type === question.type
      )
      .map((answer: ResourceRecordAnswer) => this.deserialiseSrvAnswer(answer));

    if (srvRecords.length === 0) {
      throw new DnsServerResponseError('No valid answer found');
    }

    /* If there is precisely one SRV RR, and its Target is "."
     * (the root domain), abort.
     */
    const serviceNotSupportedRecords = srvRecords.filter(
      record => record.target === '.'
    );

    if (serviceNotSupportedRecords.length === 1) {
      return null;
    }

    // Order records by priority
    const sortedSrvRecords: SrvRecord[] = srvRecords
      .filter((srvRecord: SrvRecord) => srvRecord.target !== '.')
      .sort(
        (recordA: SrvRecord, recordB: SrvRecord) =>
          recordA.priority - recordB.priority
      );

    // Order records by weight if they have the same priority
    let previousPriority: number | null =
      sortedSrvRecords.length > 0 ? sortedSrvRecords[0].priority : null;

    let recordsToProcess: SrvRecord[] = [];
    const sortedServices: DomainService[] = [];

    sortedSrvRecords.forEach((srvRecord: SrvRecord) => {
      if (srvRecord.priority !== previousPriority) {
        sortedServices.push(
          ...this.orderResourceListByWeight(recordsToProcess)
        );

        previousPriority = srvRecord.priority;

        recordsToProcess = [];
      }

      recordsToProcess.push(srvRecord);
    });

    // Process last record
    sortedServices.push(...this.orderResourceListByWeight(recordsToProcess));

    return {
      services: sortedServices,
      isDomainSecure: response.AD,
    };
  }

  /**
   * Order a list of SRV records by weight using the recommended procedure
   * described in RFC 2782.
   *
   * The records in the list must have the same priority.
   *
   * @param recordsToOrder A list of SRV records to order by weight.
   *
   * @returns A list of services ordered by weight.
   */
  private orderResourceListByWeight(
    recordsToOrder: SrvRecord[]
  ): DomainService[] {
    interface SrvRecordWithRunningSum {
      name: string;
      TTL: number;
      priority: number;
      weight: number;
      port: number;
      target: string;
      runningSum: any;
    }

    let recordsToProcess: SrvRecordWithRunningSum[] = recordsToOrder.map(
      (srvRecord: SrvRecord) => {
        return {
          ...srvRecord,
          runningSum: 0,
        };
      }
    );

    const sortedList = [];

    let moreRecordsToProcess = recordsToProcess.length > 0;

    while (moreRecordsToProcess) {
      let nextSrvRecord: SrvRecordWithRunningSum | null = null;

      const onlyOneRecordToProcess = recordsToProcess.length === 1;

      if (onlyOneRecordToProcess) {
        // Skip random selection
        nextSrvRecord = recordsToProcess[0];
        moreRecordsToProcess = false;
      } else {
        let sumAccumulator = 0;

        recordsToProcess.forEach((srvRecord: SrvRecordWithRunningSum) => {
          sumAccumulator += srvRecord.weight;

          srvRecord.runningSum = sumAccumulator;
        });

        // Return a random number between 0 and sumAccumulator:
        const randomNumber = Math.floor(Math.random() * sumAccumulator);

        const newRecordsToProcess: SrvRecordWithRunningSum[] = [];

        recordsToProcess.forEach((srvRecord: SrvRecordWithRunningSum) => {
          if (nextSrvRecord === null && randomNumber <= srvRecord.runningSum) {
            nextSrvRecord = srvRecord;
          } else {
            newRecordsToProcess.push(srvRecord);
          }
        });

        recordsToProcess = newRecordsToProcess;
      }

      // There's always an element
      sortedList.push({
        host: nextSrvRecord!.target,
        port: nextSrvRecord!.port,
      });
    }

    return sortedList;
  }

  /**
   * Parse an SRV record answer returned by a DNS resolver, and return
   * an object that represents the SRV record.
   *
   * @param answer An SRV response field returned by a DNS resolver.
   *
   * @returns An object that represents the SRV record.
   */
  private deserialiseSrvAnswer(answer: ResourceRecordAnswer): SrvRecord {
    const dataElements = answer.data.split(' ');

    if (dataElements.length !== 4) {
      throw new DnsServerResponseError('Invalid answer');
    }

    const priority = parseInt(dataElements[0], 10);

    const isPriorityValid = !isNaN(priority);

    if (!isPriorityValid) {
      throw new DnsServerResponseError(
        'Invalid priority: value could not be converted to a number'
      );
    }

    const weight = parseInt(dataElements[1], 10);

    const isWeightValid = !isNaN(weight);

    if (!isWeightValid) {
      throw new DnsServerResponseError(
        'Invalid weight: value could not be converted to a number'
      );
    }

    const port = parseInt(dataElements[2], 10);

    const isPortValid = !isNaN(port);

    if (!isPortValid) {
      throw new DnsServerResponseError(
        'Invalid port: value could not be converted to a number'
      );
    }

    const targetRegexExecArray = /^(.*?)\.?$/.exec(dataElements[3]);

    if (!targetRegexExecArray || targetRegexExecArray.length === 0) {
      throw new DnsServerResponseError('Invalid target domain name found');
    }

    const target = targetRegexExecArray[1];

    return {
      name: answer.name,
      TTL: answer.TTL,
      priority,
      weight,
      port,
      target: target === '' ? '.' : target,
    };
  }
}
