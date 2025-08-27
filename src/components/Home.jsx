import Chat from './Chat.jsx'

const Home = ({ sessionId, setSessionId }) => {
  return (
    <div>
      <Chat sessionId={sessionId} setSessionId={setSessionId} />
    </div>
  )
}

export default Home