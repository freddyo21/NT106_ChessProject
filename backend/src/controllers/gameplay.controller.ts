import { Request, Response } from "express";
import { invitationParametersSchema } from "@zess-online-chess/shared";
import * as gameplayService from "../services/gameplay.service";

export const createInvitationCode = async (req: Request, res: Response) => {
    const result = invitationParametersSchema.safeParse(req.params);

    if (!result.success) {
        return res.status(400).json({
            error: "Invalid invitation parameters",
            details: result.error.issues,
        });
    }

    const { rid: roomId } = result.data;
    const { code, expiresAt } = await gameplayService.createInvitationCode(roomId);

    return res.status(201).json({
        message: "Invitation code created successfully",
        data: {
            roomId,
            code,
            expiresAt,
        },
    });
};

export const joinGameWithInvite = async (req: Request, res: Response) => {
    return res.status(200).json({
        message: "Successfully joined the game with invite code",
        data: {
            roomId: req.params.rid,
            socketEvent: "join_room",
            socketPayload: {
                roomId: req.params.rid,
            },
        },
    });
};