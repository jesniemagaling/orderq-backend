import bcrypt from 'bcrypt';

const generateHash = async () => {
  const password = 'kitchen123';
  const hash = await bcrypt.hash(password, 10);
  console.log('Hashed password:', hash);
};

generateHash();
