import "./GameStatusUI.css"; //{Import file CSS để style cho thanh trạng thái trận đấu}

export type GameStatusType =
  | "waiting"
  | "your-turn"
  | "opponent-turn"
  | "check"
  | "checkmate"
  | "draw"
  | "disconnected"
  | "resigned"
  | "timeout-win"
  | "timeout-loss";

interface GameStatusUIProps {
  status: GameStatusType;
  message?: string;
}

function GameStatusUI({ status, message }: GameStatusUIProps) {
  //{Hàm trả về tiêu đề chính của trạng thái trận đấu}
  const getTitle = () => {
  switch (status) {
    case "waiting":
      return "Đang chờ đối thủ";
    case "your-turn":
      return "Đến lượt bạn";
    case "opponent-turn":
      return "Đang chờ đối thủ";
    case "check":
      return "Chiếu tướng";
    case "checkmate":
      return "Chiếu bí";
    case "draw":
      return "Ván cờ hòa";
    case "disconnected":
      return "Đối thủ mất kết nối";
    case "resigned":
      return "Bạn đã đầu hàng";
    case "timeout-win":
      return "Thắng vì hết giờ";
    case "timeout-loss":
      return "Thua vì hết giờ";
    default:
      return "Trạng thái trận đấu";
  }
};

  //{Hàm trả về nội dung mô tả ngắn phía dưới tiêu đề}
  const getText = () => {
  if (message) return message;

  switch (status) {
    case "waiting":
      return "Hệ thống đang tìm người chơi phù hợp để bắt đầu trận đấu.";
    case "your-turn":
      return "Hãy chọn quân cờ và thực hiện nước đi của bạn.";
    case "opponent-turn":
      return "Vui lòng chờ đối thủ hoàn thành lượt đi.";
    case "check":
      return "Vua đang bị uy hiếp. Bạn cần xử lý ngay ở lượt hiện tại.";
    case "checkmate":
      return "Ván đấu đã kết thúc bằng chiếu bí.";
    case "draw":
      return "Hai bên không phân thắng bại.";
    case "disconnected":
      return "Kết nối từ phía đối thủ đã bị gián đoạn.";
    case "resigned":
      return "Ván đấu kết thúc do bạn chọn đầu hàng.";
    case "timeout-win":
      return "Đối thủ đã hết thời gian. Bạn giành chiến thắng!";
    case "timeout-loss":
      return "Bạn đã hết thời gian suy nghĩ. Ván đấu kết thúc.";
    default:
      return "";
  }
};

  return (
    <div className={`game-status-container ${status}`}>
      <div className="game-status-indicator"></div>
      {/* {Chấm tròn nhỏ bên trái để nhấn mạnh trạng thái hiện tại} */}

      <div className="game-status-content">
        <h3>{getTitle()}</h3>
        <p>{getText()}</p>
      </div>
    </div>
  );
}

export default GameStatusUI;