import { Router } from "express";
import { authRouter } from "./auth.router";
import { gameplayRouter } from "./gameplay.router";
import { leaderboardRouter } from "./leaderboard.router";
import { matchHistoryRouter } from "./match-history.router";
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
router.use("/leaderboard", authMiddleware, leaderboardRouter);
router.use("/match-history", authMiddleware, matchHistoryRouter);

export { router };

