import "./ConnectionStatusUI.css";

type ConnectionState =
  | "connected"
  | "connecting"
  | "reconnecting"
  | "disconnected";

type ConnectionStatusUIProps = {
  status?: ConnectionState;
  serverName?: string;
  onRetry?: () => void;
  /** Chế độ thu gọn — hiện dạng pill 1 dòng, dùng trong Info tab của board */
  compact?: boolean;
};

function ConnectionStatusUI({
  status = "connected",
  serverName = "Game Server",
  onRetry,
  compact = false,
}: ConnectionStatusUIProps) {
  //{Xác định nội dung hiển thị theo từng trạng thái kết nối}
  const statusConfig = {
    connected:    { label: "Đã kết nối",       subtext: `Ứng dụng đang kết nối ổn định tới ${serverName}.`,                                                badgeClass: "connected",    showWarningBanner: false },
    connecting:   { label: "Đang kết nối",     subtext: `Đang thiết lập kết nối tới ${serverName}...`,                                                      badgeClass: "connecting",   showWarningBanner: false },
    reconnecting: { label: "Đang kết nối lại", subtext: `Kết nối vừa bị gián đoạn. Hệ thống đang thử kết nối lại...`,                                       badgeClass: "reconnecting", showWarningBanner: true  },
    disconnected: { label: "Mất kết nối",      subtext: `Không thể kết nối tới ${serverName}. Một số chức năng realtime có thể bị ảnh hưởng.`,              badgeClass: "disconnected", showWarningBanner: true  },
  };

  const currentStatus = statusConfig[status];

  //{Chế độ compact: pill 1 dòng nhỏ gọn dùng trong Info tab}
  if (compact) {
    return (
      <div className={`conn-compact ${currentStatus.badgeClass}`}>
        <div className="conn-compact__left">
          <span className="conn-compact__dot" />
          <span className="conn-compact__label">{currentStatus.label}</span>
        </div>
        <span className="conn-compact__server">{serverName}</span>
        {(status === "disconnected" || status === "reconnecting") && onRetry && (
          <button type="button" className="conn-compact__retry" onClick={onRetry}>
            Thử lại
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="connection-status-wrapper">
      {/*{Thẻ trạng thái chính hiển thị ở góc màn hình hoặc khu vực cần đặt}*/}
      <div className="connection-status-card">
        <div className="connection-status-header">
          <div className="connection-status-title-group">
            <span
              className={`connection-status-dot ${currentStatus.badgeClass}`}
            />
            <div className="connection-status-text-group">
              <h3 className="connection-status-title">Trạng thái kết nối</h3>
              <p className="connection-status-label">{currentStatus.label}</p>
            </div>
          </div>

          <span
            className={`connection-status-badge ${currentStatus.badgeClass}`}
          >
            {currentStatus.label}
          </span>
        </div>

        <div className="connection-status-body">
          <p className="connection-status-description">
            {currentStatus.subtext}
          </p>

          <div className="connection-status-meta">
            <span className="connection-status-meta-item">
              Server: <strong>{serverName}</strong>
            </span>

            <span className="connection-status-meta-item">
              Realtime: <strong>{status === "connected" ? "Ổn định" : "Gián đoạn"}</strong>
            </span>
          </div>

          {(status === "disconnected" || status === "reconnecting") && (
            <div className="connection-status-actions">
              <button
                type="button"
                className="connection-status-retry-btn"
                onClick={onRetry}
              >
                Thử kết nối lại
              </button>
            </div>
          )}
        </div>
      </div>

      {/*{Banner cảnh báo phụ để người dùng nhận biết rõ hơn khi mất kết nối}*/}
      {currentStatus.showWarningBanner && (
        <div className={`connection-warning-banner ${currentStatus.badgeClass}`}>
          <span className="connection-warning-icon">⚠</span>
          <div className="connection-warning-content">
            <strong>
              {status === "reconnecting"
                ? "Đang thử khôi phục kết nối"
                : "Kết nối tới server đã bị ngắt"}
            </strong>
            <p>
              {status === "reconnecting"
                ? "Vui lòng chờ trong giây lát để hệ thống tự kết nối lại."
                : "Hãy kiểm tra mạng hoặc thử kết nối lại để tiếp tục sử dụng đầy đủ chức năng."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConnectionStatusUI;