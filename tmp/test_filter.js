const fs = require('fs');
const quotes = require('./src/data/quotesData.json');

// Blacklisted authors (dictators, disgraced figures, brand names, nonsense tags)
const blacklistedAuthors = new Set([
  'Joseph Stalin',
  'Bill Cosby',
  'Lululemon',
  'Wit'
]);

// Test each quote for rubbish, boastful, sexual, medical complaint, or trash-talk quotes
function isRubbish(q) {
  if (blacklistedAuthors.has(q.author)) {
    return 'Blacklisted author: ' + q.author;
  }

  const text = q.text.toLowerCase();
  
  // Sexual orientation / sex / body / underwear remarks
  if (text.includes('lesbian') || text.includes('panties') || text.includes('cleavage') || 
      text.includes('chanel no') || text.includes('make love to a man') || text.includes('sexy for their man')) {
    return 'Sexual / body / personal remark';
  }

  // Diseases / medical ailments / physical complaints
  if (text.includes('parkinson') || text.includes('gave me this illness') || text.includes('make medicine sick')) {
    return 'Illness / medical condition remark';
  }

  // Sports trash talk / violence / insults / boasting
  if (text.includes('gorilla in manila') || text.includes('murdered a rock') || 
      text.includes('whup whoever') || text.includes('get up sucker') || 
      text.includes('sucka') || text.includes('beat people up') ||
      text.includes('that all you got, george') || text.includes('hard to be humble') ||
      text.includes('astronaut of boxing') || text.includes('pretty as a girl') ||
      text.includes('pretty, and can\'t possibly be beat') || text.includes('bad man, and i\'m pretty') ||
      text.includes('how great i really am') || text.includes('still the greatest') ||
      text.includes('slave names') || text.includes('kill my dog') ||
      text.includes('first wife') || text.includes('light switch in my hotel room') ||
      text.includes('wake up and apologize') || text.includes('now you see me, now you don\'t. george') ||
      text.includes('frazier\'s got two chances') || text.includes('when my title was taken away boxing died') ||
      text.includes('at home i am a nice guy: but i don\'t want the world to know')) {
    return 'Boasting / trash talk / personal dispute';
  }

  return null;
}

const results = [];
quotes.forEach(q => {
  const reason = isRubbish(q);
  if (reason) {
    results.push({ quote: q, reason });
  }
});

console.log('Total flagged so far:', results.length);
results.forEach(r => console.log(`[${r.quote.id}] (${r.quote.author}): "${r.quote.text}" -> ${r.reason}`));
