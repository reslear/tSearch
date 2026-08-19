const getArgvValue = (key) => {
  let result = null;
  process.argv.some((arg, index) => {
    if (arg === key) {
      result = process.argv[index + 1];
      return true;
    }
    return false;
  });
  return result;
};

export { getArgvValue };
export default getArgvValue;
