import { Router } from "express";
import * as gameplayController from "../controllers/gameplay.controller";
import { verifyInvite } from "../middlewares/invite-link.middleware";
import { asyncHandler } from "../middlewares/error-handlers";

const gameplayRouter = Router();

gameplayRouter.post("/invite/:rid/create", asyncHandler(gameplayController.createInvitationCode));
gameplayRouter.post("/join/:rid", verifyInvite, asyncHandler(gameplayController.joinGameWithInvite));

export { gameplayRouter };