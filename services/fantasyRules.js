// The rules of the game, in one place so the API and the frontend agree
const SALARY_CAP = 100;
const ROSTER_SLOTS = { QB: 1, RB: 2, WR: 2, TE: 1 };
const POSITIONS = Object.keys(ROSTER_SLOTS);
const ROSTER_SIZE = Object.values(ROSTER_SLOTS).reduce((a, b) => a + b, 0);

module.exports = { SALARY_CAP, ROSTER_SLOTS, POSITIONS, ROSTER_SIZE };
