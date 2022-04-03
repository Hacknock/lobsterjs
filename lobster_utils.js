function matchStrikethrough(text) {
  const regexp = /~~[^~\f\r\n]+?~~/i;
  const found = text.match(regexp);
  if (found == null) {
    return null;
  }
  return found[0];
}

const lobster_utils = {
  matchStrikethrough,
};

export default lobster_utils;
