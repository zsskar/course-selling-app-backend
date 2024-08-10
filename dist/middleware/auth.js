"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateJwt = exports.SECRET = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
exports.SECRET = "SECr3t"; // This should be in an environment variable in a real application
const authenticateJwt = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.sendStatus(401); // No authorization header present
    }
    const token = authHeader.split(" ")[1];
    if (!token) {
        return res.sendStatus(401); // No token present
    }
    jsonwebtoken_1.default.verify(token, exports.SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: "invalid token" }); // Invalid token
        }
        const user = JSON.parse(JSON.stringify(decoded));
        req.headers.email = user.email;
        console.log("Decoded Email :", user.email);
        next();
    });
};
exports.authenticateJwt = authenticateJwt;
