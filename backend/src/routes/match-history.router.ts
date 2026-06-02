import { Router } from "express";
import { asyncHandler } from "../middlewares/error-handlers";
import * as matchHistoryController from "../controllers/match-history.controller";

const matchHistoryRouter = Router();

matchHistoryRouter.get("/me", asyncHandler(matchHistoryController.getMyMatchHistory));

export { matchHistoryRouter };
