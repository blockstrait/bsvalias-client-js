function checkPaymailHandle(handle: string) {
  if (typeof handle !== 'string') {
    throw new TypeError('`handle` must be a string');
  }

  const handleRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!handleRegex.test(handle)) {
    throw new Error('`handle` must be a valid paymail handle');
  }
}

const Validators = {
  checkPaymailHandle,
};

export default Validators;
