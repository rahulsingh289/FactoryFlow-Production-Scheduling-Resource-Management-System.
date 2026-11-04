// Accounts and sign-in.
const bcrypt = require('bcryptjs');
const { memData, isMysql, q } = require('./shared');

// ----------------------------- Auth / users -------------------------------
async function findUserByUsername(username) {
  if (isMysql()) {
    const [rows] = await q('SELECT * FROM users WHERE username = ?', [username]);
    return rows[0] || null;
  }
  return memData().users.find((u) => u.username === username) || null;
}

async function findUserByEmail(email) {
  if (isMysql()) {
    const [rows] = await q('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0] || null;
  }
  return memData().users.find((u) => u.email === email) || null;
}

// Create a new account. Returns the created user row (without the hash).
async function createUser({ username, email, full_name, password, role = 'MANAGER' }) {
  const hash = await bcrypt.hash(password, 10);
  if (isMysql()) {
    const [res] = await q(
      `INSERT INTO users (username, email, password_hash, full_name, role) VALUES (?,?,?,?,?)`,
      [username, email, hash, full_name, role]
    );
    return { user_id: res.insertId, username, email, full_name, role };
  }
  const d = memData();
  const user = { user_id: ++d.seq.user, username, email, password_hash: hash, full_name, role };
  d.users.push(user);
  return { user_id: user.user_id, username, email, full_name, role };
}

module.exports = { findUserByUsername, findUserByEmail, createUser };
