import { useEffect, useMemo, useRef, useState } from "react";
import EmojiPicker, { type EmojiClickData, Theme } from "emoji-picker-react";
import "./ChatUI.css";
import defaultAvatar from "../Image/LobbyIcon.svg";

export type ChatMessage = {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
  isOwn: boolean;
};

type ChatUIProps = {
  roomName?: string;
  currentUserName?: string;
  initialMessages?: ChatMessage[];
  onSendMessage?: (message: ChatMessage) => void;
  /** Đường dẫn ảnh/SVG thay thế chữ cái trong avatar header — mặc định dùng logo Zess */
  avatarSrc?: string;
};

function ChatUI({
  roomName = "Phòng chat",
  currentUserName = "Bạn",
  initialMessages = [],
  onSendMessage,
  avatarSrc = defaultAvatar, //{Mặc định dùng logo Zess cho mọi ChatUI trong dự án}
}: ChatUIProps) {
  //{Lưu toàn bộ danh sách tin nhắn đang hiển thị trên giao diện}
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);

  //{Lưu nội dung người dùng đang nhập trong ô chat}
  const [draftMessage, setDraftMessage] = useState("");

  //{Điều khiển mở/đóng bảng chọn emoji}
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

  //{Ref cho vùng cuối danh sách tin nhắn để auto scroll xuống dưới}
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  //{Ref cho khu vực emoji để bắt click ra ngoài}
  const emojiPickerWrapperRef = useRef<HTMLDivElement | null>(null);

  //{Ref cho textarea để focus lại sau khi chọn emoji}
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  //{Memo hóa tiêu đề phụ — ẩn bằng CSS ở lobby nhưng giữ lại ở các context khác}
  const roomSubtitle = useMemo(() => {
    return "Nhấn Enter để gửi · Shift + Enter để xuống dòng";
  }, []);

  useEffect(() => {
    //{Mỗi khi có tin nhắn mới thì tự động kéo xuống cuối khung chat}
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    //{Đóng emoji picker khi người dùng click ra ngoài vùng picker}
    function handleClickOutside(event: MouseEvent) {
      if (
        emojiPickerWrapperRef.current &&
        !emojiPickerWrapperRef.current.contains(event.target as Node)
      ) {
        setIsEmojiPickerOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  function createTimestamp() {
    //{Tạo timestamp ngắn gọn theo định dạng giờ:phút cho giao diện chat}
    return new Date().toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function handleSendMessage() {
    //{Loại bỏ khoảng trắng đầu cuối để tránh gửi tin nhắn rỗng}
    const trimmedMessage = draftMessage.trim();

    if (!trimmedMessage) {
      return;
    }

    //{Tạo object tin nhắn mới theo cấu trúc chuẩn}
    const newMessage: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sender: currentUserName,
      text: trimmedMessage,
      timestamp: createTimestamp(),
      isOwn: true,
    };

    setMessages((prevMessages) => [...prevMessages, newMessage]);
    setDraftMessage("");
    setIsEmojiPickerOpen(false);
    onSendMessage?.(newMessage);
    textareaRef.current?.focus();
  }

  function handleTextareaKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>
  ) {
    //{Enter gửi, Shift + Enter xuống dòng}
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  }

  function handleEmojiClick(emojiData: EmojiClickData) {
    setDraftMessage((prevMessage) => `${prevMessage}${emojiData.emoji}`);
    textareaRef.current?.focus();
  }

  return (
    <section className="chat-ui">
      <div className="chat-ui__header">
        <div className="chat-ui__header-left">
          {/* Avatar — luôn hiện SVG logo, trừ khi avatarSrc bị truyền null/undefined tường minh */}
          <div className="chat-ui__avatar">
            <img
              src={avatarSrc}
              alt={roomName}
              className="chat-ui__avatar-img"
            />
          </div>

          <div>
            <h2 className="chat-ui__title">{roomName}</h2>
            <p className="chat-ui__subtitle">{roomSubtitle}</p>
          </div>
        </div>

        <div className="chat-ui__status">
          <span className="chat-ui__status-dot" />
          <span>Sẵn sàng</span>
        </div>
      </div>

      <div className="chat-ui__messages">
        {messages.length === 0 ? (
          <div className="chat-ui__empty">
            <div className="chat-ui__empty-icon">💬</div>
            <p className="chat-ui__empty-title">Chưa có tin nhắn nào</p>
            <p className="chat-ui__empty-text">
              Hãy gửi tin nhắn đầu tiên trong phòng này.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`chat-ui__message-row ${
                message.isOwn ? "chat-ui__message-row--own" : ""
              }`}
            >
              <div
                className={`chat-ui__message-bubble ${
                  message.isOwn ? "chat-ui__message-bubble--own" : ""
                }`}
              >
                {!message.isOwn && (
                  <span className="chat-ui__message-sender">{message.sender}</span>
                )}

                <p className="chat-ui__message-text">{message.text}</p>

                <span className="chat-ui__message-time">{message.timestamp}</span>
              </div>
            </div>
          ))
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-ui__footer">
        <div className="chat-ui__input-wrapper">
          <textarea
            ref={textareaRef}
            className="chat-ui__textarea"
            placeholder="Nhập tin nhắn..."
            value={draftMessage}
            onChange={(event) => setDraftMessage(event.target.value)}
            onKeyDown={handleTextareaKeyDown}
            rows={1}
          />

          <div className="chat-ui__actions" ref={emojiPickerWrapperRef}>
            <button
              type="button"
              className="chat-ui__icon-button"
              onClick={() => setIsEmojiPickerOpen((prevState) => !prevState)}
              aria-label="Mở bảng emoji"
              title="Emoji"
            >
              😊
            </button>

            {isEmojiPickerOpen && (
              <div className="chat-ui__emoji-picker">
                <EmojiPicker
                  theme={Theme.DARK}
                  onEmojiClick={handleEmojiClick}
                  width={320}
                  height={380}
                  lazyLoadEmojis
                  searchDisabled={false}
                  skinTonesDisabled={false}
                  previewConfig={{ showPreview: false }}
                />
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          className="chat-ui__send-button"
          onClick={handleSendMessage}
        >
          Gửi
        </button>
      </div>
    </section>
  );
}

export default ChatUI;