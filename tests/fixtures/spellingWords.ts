export const SPELLING_WORDS: string[] = `
cat dog sun hat bed run jump play book tree fish bird rain snow wind star moon
happy friend school teacher family garden window yellow purple orange monkey
because people water would could should there their where which about again
beautiful different favorite important together through thought brought caught
daughter neighbor weight eight height trouble double country young enough
laugh cough tough rough answer special surprise remember believe receive
separate necessary definitely embarrass occasion success address argument
calendar character community conscience curiosity dictionary environment
exercise experience familiar government guarantee hungry interest knowledge
library lightning marvelous mischievous mysterious necessary neighborhood
opportunity paragraph perform physical possible probably recognize restaurant
rhythm schedule science sentence sincerely strength temperature tomorrow
unique vacuum vegetable weather weird wednesday whether yesterday adventure
ancient athlete balance bicycle branch breathe bridge capture careful castle
century chocolate circle climate collect compare complete confuse continue
courage creature crystal decide describe develop discover distance education
electric engine escape evening examine explain february fountain freedom
frighten general gentle grateful grocery guitar harbor healthy imagine
instead island journey kitchen language machine measure message minute
mountain muscle natural notice ocean office pattern picture pleasure pretty
promise question quiet reason science season simple strange student subject
summer surface thousand traveler usually village visitor whistle wonder
writing
`
  .split(/\s+/)
  .filter(Boolean)
  .filter((w, i, a) => a.indexOf(w) === i);
