import isPunctuation from "./isPunctuation.js";

const isBoundary = (leftChar, rightChar) => isPunctuation(leftChar) && isPunctuation(rightChar);

export default isBoundary;