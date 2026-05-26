import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { asyncHandler } from "../middlewares/error-handlers";

const authRouter = Router();

authRouter.post("/login", asyncHandler(authController.login));
authRouter.post("/register", asyncHandler(authController.register));
authRouter.post("/refresh", asyncHandler(authController.refresh));
authRouter.post("/logout", asyncHandler(authController.logout));
authRouter.post("/forgot-password", asyncHandler(authController.forgotPassword));
authRouter.post("/change-password", asyncHandler(authController.changePassword));

export { authRouter };