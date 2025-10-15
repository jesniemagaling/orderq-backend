import jwt from 'jsonwebtoken';

export const verifyToken = (req, res, next) => {
  const header = req.headers['authorization'];
  if (!header) return res.status(403).json({ message: 'Token required' });

  const token = header.split(' ')[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err)
      return res.status(401).json({ message: 'Invalid or expired token' });
    req.user = decoded;
    next();
  });
};

// restrict roles
export const verifyRole = (roles = []) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role))
      return res.status(403).json({ message: 'Access denied' });
    next();
  };
};
