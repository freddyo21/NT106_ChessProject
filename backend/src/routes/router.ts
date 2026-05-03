import { Router } from "express";
import { authRouter } from "./auth.router";
import { gameplayRouter } from "./gameplay.router";
import { authMiddleware } from "../middlewares/auth.middleware";

const router: Router = Router();

router.get("/ping", (req, res) => {
    res.send({
        message: "Pong! Backend is alive!",
        timestamp: new Date().toISOString()
    });
});

router.use("/auth", authRouter);
router.use("/gameplay", authMiddleware, gameplayRouter);

export { router };