import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Edit, LogOut, Search, MessageCircle, X, ChevronLeft } from 'lucide-react';

// Pick a consistent avatar color per name
const avatarColor = (name = '') => {
  const colors = ['color-0','color-1','color-2','color-3','color-4','color-5','color-6','color-7'];
  let hash = 0;
  for (let c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const formatTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'numeric', year: '2-digit' });
};

export default function ChatList() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [currentUser, setCurrentUser]     = useState(null);
  const [filterText, setFilterText]       = useState('');

  // Modal state
  const [modalOpen, setModalOpen]         = useState(false);
  const [searchEmail, setSearchEmail]     = useState('');
  const [searchResult, setSearchResult]   = useState(null);
  const [suggestions, setSuggestions]     = useState([]);
  const [modalErr, setModalErr]           = useState('');
  const [modalLoading, setModalLoading]   = useState(false);

  const navigate = useNavigate();

  const fetchConversations = useCallback(async (user) => {
    try {
      const { data: myPart } = await supabase
        .from('conversation_participants').select('conversation_id').eq('user_id', user.id);
      const ids = myPart?.map(p => p.conversation_id) || [];
      if (!ids.length) { setConversations([]); return; }

      const list = [];
      for (const cid of ids) {
        const { data: others } = await supabase
          .from('conversation_participants').select('user_id').eq('conversation_id', cid).neq('user_id', user.id);
        if (!others?.length) continue;
        const { data: profile } = await supabase
          .from('profiles').select('email, display_name').eq('id', others[0].user_id).single();
        const { data: lastMsg } = await supabase
          .from('messages').select('content, created_at, sender_id')
          .eq('conversation_id', cid).order('created_at', { ascending: false }).limit(1);
        list.push({
          id: cid,
          otherUser: {
            id: others[0].user_id,
            email: profile?.email || 'Unknown',
            display_name: profile?.display_name || profile?.email?.split('@')[0] || 'User',
          },
          lastMessage: lastMsg?.[0] || null,
        });
      }
      list.sort((a, b) => new Date(b.lastMessage?.created_at || 0) - new Date(a.lastMessage?.created_at || 0));
      setConversations(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { navigate('/login', { replace: true }); return; }
      setCurrentUser(user);
      fetchConversations(user);
    });
  }, [navigate, fetchConversations]);

  const openModal = async () => {
    setModalOpen(true); setSearchEmail(''); setSearchResult(null); setModalErr('');
    const { data } = await supabase.from('profiles').select('id,email,display_name')
      .neq('id', currentUser?.id).limit(8);
    setSuggestions(data || []);
  };

  const doSearch = async (e) => {
    e.preventDefault(); setModalErr(''); setSearchResult(null);
    if (!searchEmail.trim()) { setModalErr('Enter an email address.'); return; }
    if (searchEmail.trim().toLowerCase() === currentUser?.email?.toLowerCase()) {
      setModalErr("You can't chat with yourself."); return;
    }
    setModalLoading(true);
    const { data: profile } = await supabase.from('profiles').select('id,email,display_name')
      .eq('email', searchEmail.trim().toLowerCase()).maybeSingle();
    setModalLoading(false);
    if (!profile) setModalErr('No user found with that email.');
    else setSearchResult(profile);
  };

  const startChat = async (target) => {
    setModalLoading(true);
    setModalErr('');
    try {
      const { data: myPart, error: partErr } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', currentUser.id);
      
      if (partErr) throw partErr;

      const myCids = myPart?.map(p => p.conversation_id) || [];
      if (myCids.length) {
        const { data: shared, error: sharedErr } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .in('conversation_id', myCids)
          .eq('user_id', target.id)
          .limit(1);

        if (sharedErr) throw sharedErr;

        if (shared?.length) {
          setModalOpen(false);
          navigate(`/chat/${shared[0].conversation_id}`);
          return;
        }
      }

      const { data: conv, error: convErr } = await supabase
        .from('conversations')
        .insert({})
        .select()
        .single();
      
      if (convErr) throw convErr;

      const { error: insertPartErr } = await supabase
        .from('conversation_participants')
        .insert([
          { conversation_id: conv.id, user_id: currentUser.id },
          { conversation_id: conv.id, user_id: target.id },
        ]);

      if (insertPartErr) throw insertPartErr;

      setModalOpen(false);
      navigate(`/chat/${conv.id}`);
    } catch (err) {
      console.error('Error starting chat:', err);
      setModalErr(err.message || 'Could not start chat. Please verify your database schema has been created.');
    } finally {
      setModalLoading(false);
    }
  };


  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const filtered = conversations.filter(c =>
    c.otherUser.display_name.toLowerCase().includes(filterText.toLowerCase())
  );

  if (loading) return (
    <div className="wa-loading"><div className="spinner"></div><p>Loading chats…</p></div>
  );

  return (
    <div className="chatlist-page">
      {/* ── Header ── */}
      <header className="chatlist-header">
        <div className="chatlist-header-row">
          <span className="chatlist-app-title">ChatApp</span>
          <div className="chatlist-header-actions">
            <button className="wa-icon-btn" onClick={openModal} title="New chat">
              <Edit size={20} />
            </button>
            <button className="wa-icon-btn" onClick={handleLogout} title="Log out">
              <LogOut size={20} />
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="chatlist-search-wrap">
          <Search size={16} className="chatlist-search-icon" />
          <input
            type="text"
            className="chatlist-search"
            placeholder="Search or start new chat"
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
          />
        </div>
      </header>

      {/* ── Conversation List ── */}
      <main className="chatlist-body">
        {filtered.length === 0 ? (
          <div className="wa-empty">
            <div className="wa-empty-icon"><MessageCircle size={44} /></div>
            <h3>No chats yet</h3>
            <p>Tap the pencil icon above to start a conversation with someone.</p>
          </div>
        ) : (
          filtered.map(conv => {
            const name = conv.otherUser.display_name;
            const isMine = conv.lastMessage?.sender_id === currentUser?.id;
            const preview = conv.lastMessage
              ? `${isMine ? 'You: ' : ''}${conv.lastMessage.content}`
              : 'Tap to open conversation';
            return (
              <Link to={`/chat/${conv.id}`} key={conv.id} className="conv-row">
                <div className={`conv-avatar ${avatarColor(name)}`}>
                  {name[0]?.toUpperCase()}
                </div>
                <div className="conv-info">
                  <div className="conv-info-top">
                    <span className="conv-name ellipsis">{name}</span>
                    <span className="conv-time">{formatTime(conv.lastMessage?.created_at)}</span>
                  </div>
                  <div className="conv-info-bottom">
                    <span className="conv-preview ellipsis">{preview}</span>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </main>

      {/* FAB */}
      <button className="chatlist-fab" onClick={openModal} title="New chat">
        <MessageCircle size={26} fill="currentColor" strokeWidth={0} />
      </button>

      {/* ── New Chat Drawer Modal ── */}
      {modalOpen && (
        <div className="wa-overlay" onClick={() => setModalOpen(false)}>
          <div className="wa-drawer" onClick={e => e.stopPropagation()}>
            <div className="wa-drawer-header">
              <button className="wa-icon-btn" onClick={() => setModalOpen(false)}>
                <ChevronLeft size={22} />
              </button>
              <span className="wa-drawer-title">New Chat</span>
            </div>

            <div className="wa-drawer-body">
              {modalErr && <div className="wa-error">{modalErr}</div>}

              {/* Email search */}
              <form onSubmit={doSearch} className="wa-search-input-wrap">
                <input
                  type="email"
                  className="wa-search-field"
                  placeholder="Search by email address…"
                  value={searchEmail}
                  onChange={e => setSearchEmail(e.target.value)}
                  disabled={modalLoading}
                />
                <button type="submit" className="wa-search-btn" disabled={modalLoading}>
                  {modalLoading ? '…' : 'Search'}
                </button>
              </form>

              {/* Search result */}
              {searchResult && (
                <>
                  <p className="wa-section-label">Result</p>
                  <ContactRow user={searchResult} onStart={startChat} />
                </>
              )}

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <>
                  <p className="wa-section-label">Contacts on ChatApp</p>
                  {suggestions.map(u => (
                    <ContactRow key={u.id} user={u} onStart={startChat} />
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ContactRow({ user, onStart }) {
  const name = user.display_name || user.email?.split('@')[0] || 'User';
  return (
    <div className="wa-contact-row" onClick={() => onStart(user)}>
      <div className={`conv-avatar ${avatarColor(name)}`} style={{ width: 46, height: 46 }}>
        {name[0]?.toUpperCase()}
      </div>
      <div>
        <div className="wa-contact-name">{name}</div>
        <div className="wa-contact-email">{user.email}</div>
      </div>
    </div>
  );
}
