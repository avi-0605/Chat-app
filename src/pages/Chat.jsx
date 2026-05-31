import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ChevronLeft, Send, MessageSquare, Smile, Paperclip } from 'lucide-react';

// Pick a consistent avatar color per name
const avatarColor = (name = '') => {
  const colors = ['color-0','color-1','color-2','color-3','color-4','color-5','color-6','color-7'];
  let hash = 0;
  for (let c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

export default function Chat() {
  const { id } = useParams(); // conversation_id
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [partner, setPartner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const initChat = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate('/login', { replace: true });
          return;
        }
        setCurrentUser(user);
        
        // Fetch participant detail
        await fetchPartnerDetails(id, user.id);
        // Load initial messages
        await fetchMessages(id);
      } catch (err) {
        console.error('Initialization error:', err.message);
      } finally {
        setLoading(false);
      }
    };

    initChat();
  }, [id, navigate]);

  // Subscribe to real-time updates for new messages in this conversation
  useEffect(() => {
    if (!id) return;

    const channel = supabase
      .channel(`realtime-messages:${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${id}`,
        },
        (payload) => {
          const newMsg = payload.new;
          setMessages((prev) => {
            // Avoid duplicate message appending
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  // Handle auto-scroll on message updates
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchPartnerDetails = async (conversationId, currentUserId) => {
    const { data: participantData, error } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .neq('user_id', currentUserId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching partner user_id:', error.message);
      return;
    }

    if (participantData) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, display_name')
        .eq('id', participantData.user_id)
        .single();

      setPartner({
        id: participantData.user_id,
        email: profile?.email || 'Partner',
        display_name: profile?.display_name || profile?.email?.split('@')[0] || 'User',
      });
    }
  };

  const fetchMessages = async (conversationId) => {
    const { data: msgs, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading messages:', error.message);
      return;
    }

    setMessages(msgs || []);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();

    if (!inputMessage.trim() || sending || !currentUser) return;

    setSending(true);
    const contentText = inputMessage.trim();
    setInputMessage(''); // optimistic input clear

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: id,
          sender_id: currentUser.id,
          content: contentText,
          created_at: new Date().toISOString(),
        })
        .select();

      if (error) throw error;
      
      // If we returned data, we can optimistically set it, 
      // but the real-time subscription also syncs it automatically.
      if (data && data[0]) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data[0].id)) return prev;
          return [...prev, data[0]];
        });
      }
    } catch (err) {
      console.error('Send error:', err.message);
    } finally {
      setSending(false);
    }
  };

  const formatMessageTime = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessagesWithDates = () => {
    const rendered = [];
    let lastDateStr = null;

    messages.forEach((msg) => {
      const msgDate = new Date(msg.created_at);
      const dateStr = msgDate.toDateString();

      if (dateStr !== lastDateStr) {
        let label = msgDate.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        if (dateStr === today) {
          label = 'TODAY';
        } else if (dateStr === yesterday) {
          label = 'YESTERDAY';
        }

        rendered.push(
          <div key={`date-${msg.id}`} className="chat-date-sep">
            <span className="chat-date-pill">{label}</span>
          </div>
        );
        lastDateStr = dateStr;
      }

      const isSentByMe = msg.sender_id === currentUser?.id;
      rendered.push(
        <div 
          key={msg.id} 
          className={`msg-wrap ${isSentByMe ? 'sent' : 'received'}`}
        >
          <div className="msg-bubble">
            <div className="msg-text">{msg.content}</div>
            <div className="msg-meta">
              <span className="msg-time">
                {formatMessageTime(msg.created_at)}
              </span>
              {isSentByMe && <span className="msg-ticks">✓✓</span>}
            </div>
          </div>
        </div>
      );
    });

    return rendered;
  };

  if (loading) {
    return (
      <div className="wa-loading">
        <div className="spinner"></div>
        <p>Opening conversation...</p>
      </div>
    );
  }

  const partnerName = partner?.display_name || 'User';

  return (
    <div className="chat-page">
      {/* Active Conversation Header */}
      <header className="chat-header">
        <button className="wa-icon-btn chat-back" onClick={() => navigate('/chat-list')} title="Back to Chats">
          <ChevronLeft size={24} />
        </button>

        <div className={`chat-header-avatar conv-avatar ${avatarColor(partnerName)}`} style={{ width: 40, height: 40 }}>
          {partnerName[0]?.toUpperCase()}
        </div>

        <div className="chat-header-info" style={{ marginLeft: 8 }}>
          <span className="chat-header-name ellipsis">{partnerName}</span>
          <span className="chat-header-status">online</span>
        </div>
      </header>

      {/* Message Feed Display */}
      <main className="chat-messages-area">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <div className="chat-empty-pill">
              🔒 Messages are end-to-end encrypted. No one outside of this chat can read them.
            </div>
            <div className="wa-empty-icon" style={{ marginTop: 24 }}>
              <MessageSquare size={40} />
            </div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--wa-text-primary)' }}>
              No messages yet
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--wa-text-secondary)', maxWidth: 240, margin: '4px auto 0', lineSize: 1.4 }}>
              Say hello! Send a message to start chatting with {partnerName}.
            </p>
          </div>
        ) : (
          renderMessagesWithDates()
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Input bar section */}
      <form onSubmit={handleSendMessage} className="chat-input-bar">
        <div className="chat-input-wrap">
          <Smile size={22} className="chat-input-icon" style={{ cursor: 'pointer' }} />
          <textarea
            className="chat-textarea"
            placeholder="Type a message"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(e);
              }
            }}
            rows={1}
            disabled={sending}
            maxLength={1000}
          />
          <Paperclip size={22} className="chat-input-icon" style={{ cursor: 'pointer' }} />
        </div>
        <button 
          type="submit" 
          className="chat-send-btn" 
          disabled={!inputMessage.trim() || sending}
        >
          <Send size={18} fill="currentColor" strokeWidth={0} />
        </button>
      </form>
    </div>
  );
}
