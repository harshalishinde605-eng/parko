const bcrypt = require('bcryptjs');
const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
const hashPassword = (plain) => bcrypt.hash(plain, ROUNDS);
const comparePassword = (plain, hash) => bcrypt.compare(plain, hash);
module.exports = { hashPassword, comparePassword };
