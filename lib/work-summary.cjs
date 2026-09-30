function shortSummary(value, limit = 260) {
  const plain = String(value || '').replace(/[\r\n*_`~|<>@\\\[\]()]/g, ' ').replace(/\s+/g, ' ').trim();
  const sentences = [...new Intl.Segmenter('fr', { granularity: 'sentence' }).segment(plain)].slice(0, 2).map(item => item.segment.trim()).join(' ');
  if (sentences.length <= limit) return sentences;
  return `${sentences.slice(0, limit - 1).replace(/\s+\S*$/, '').trim()}…`;
}
module.exports = { shortSummary };
