"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
exports.app = (0, express_1.default)();
const port = 9000;
const admin_1 = __importDefault(require("./routes/admin"));
const user_1 = __importDefault(require("./routes/user"));
const devicelog_1 = __importDefault(require("./routes/devicelog"));
const cors_1 = __importDefault(require("cors"));
exports.app.use((0, cors_1.default)());
exports.app.use(express_1.default.json());
exports.app.use("/api/admin", admin_1.default);
exports.app.use("/api/user", user_1.default);
exports.app.use("/api/device-logs", devicelog_1.default);
exports.app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
});
const connectWithRetry = () => {
    console.log("MongoDB connection with retry");
    mongoose_1.default
        .connect("mongodb+srv://rashid11612612:JustTesting123@rashid-cluster.ftut18u.mongodb.net/", {
        dbName: "course_selling_app",
    })
        .then(() => {
        console.log("MongoDB is connected");
    })
        .catch((err) => {
        console.error("MongoDB connection unsuccessful, retry after 5 seconds. ", err);
        setTimeout(connectWithRetry, 5000);
    });
};
connectWithRetry();
