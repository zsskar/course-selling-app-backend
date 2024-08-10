import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
export const SECRET = "SECr3t"; // This should be in an environment variable in a real application

export const authenticateJwt = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.sendStatus(401); // No authorization header present
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.sendStatus(401); // No token present
  }

  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "invalid token" }); // Invalid token
    }
    const user = JSON.parse(JSON.stringify(decoded));

    req.headers.email = user.email;
    console.log("Decoded Email :", user.email);
    next();
  });
};
