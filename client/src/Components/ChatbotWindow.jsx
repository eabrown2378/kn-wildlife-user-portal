import { useState, useContext } from 'react';
import axios from 'axios';
import { QueryResultContext } from '../Context/QueryResultContext';

export default function ChatbotWindow({ onClose }) {
  const [input, setInput] = useState('');
  const [chatLog, setChatLog] = useState([]);
  const [loading, setLoading] = useState(false);

  const queryResult = useContext(QueryResultContext); 

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = input;
    setChatLog([...chatLog, { sender: 'user', text: userMessage }]);
    setInput('');
    setLoading(true);

    try {
      const res = await axios.post('http://localhost:8080/chatbot', {
        message: userMessage,
        graphResult: queryResult   
      });

      setChatLog(prev => [...prev, { sender: 'bot', text: res.data.response }]);
    } catch (err) {
      setChatLog(prev => [...prev, { sender: 'bot', text: '⚠️ Error contacting chatbot.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '80px',
      right: '20px',
      width: '300px',
      height: '400px',
      background: '#fff',
      border: '1px solid #ccc',
      borderRadius: '8px',
      display: 'flex',
      flexDirection: 'column',
      padding: '10px',
      zIndex: 1000
    }}>
      <button onClick={onClose}>❌</button>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {chatLog.map((msg, i) => (
          <div key={i} style={{ textAlign: msg.sender === 'user' ? 'right' : 'left' }}>
            <p><b>{msg.sender === 'user' ? 'You' : 'Bot'}:</b> {msg.text}</p>
          </div>
        ))}
        {loading && <p>Bot is typing...</p>}
      </div>
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && sendMessage()}
        placeholder="Ask the chatbot..."
      />
    </div>
  );
}
