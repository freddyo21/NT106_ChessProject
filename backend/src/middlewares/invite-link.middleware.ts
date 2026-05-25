import { NextFunction, Request, Response } from "express";
import { invitationParametersSchema } from "@zess-online-chess/shared";
import { verifyInvitationCode } from "../services/gameplay.service";

export const verifyInvite = async (req: Request, res: Response, next: NextFunction) => {
    const result = invitationParametersSchema.safeParse(req.params);

    if (!result.success) {
        return res.status(400).json({
            error: "Invalid invitation parameters",
            details: result.error.issues,
        });
    }

    const { rid: roomId } = result.data;
    const { code } = req.query;

    const codeValue = Array.isArray(code) ? code[0] : code;
    const codeString = typeof codeValue === "string" ? codeValue : null;

    if (!codeString) {
        return res.status(400).json({ error: "Missing invitation code" });
    }

    const validationResult = await verifyInvitationCode(roomId, codeString);

    if (!validationResult.isValid) {
        return res.status(403).json({
            error: validationResult.error ?? "Invalid invitation code",
        });
    }

    return next();
};
