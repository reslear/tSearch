import TreeAdapter from "./treeAdapter";
import parse5 from 'parse5';

const getDoc5 = (html, location, document) => {
  const doc = parse5.parse(html, {
    treeAdapter: new TreeAdapter(document)
  });

  const base = doc.head.querySelector('base');
  if (!base) {
    const base = doc.createElement('base');
    base.href = location;
    doc.head.appendChild(base);
  }

  return doc;
};

export default getDoc5;
