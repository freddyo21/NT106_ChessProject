export type GameResult = "white_win" | "black_win" | "draw";

export type TerminationReason =
    | "checkmate"
    | "resign"
    | "timeout"
    | "stalemate"
    | "draw_agreement"
    | "threefold_repetition"
    | "fifty_move_rule"
    | "insufficient_material"
    | "aborted";

export type GameStatus = "waiting" | "ongoing" | "finished" | "aborted";

export type PieceColor = "white" | "black";