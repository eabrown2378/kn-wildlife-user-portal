import QueryFields from './Components/QueryFields';
import ReactGA from 'react-ga4';
import './styles/App.css';
import { useEffect } from 'react';
import AnalyticsDisclosure from './Components/AnalyticsDisclosure';
import AuthProvider from './Components/Auth/AuthProvider';
import AuthGate from './Components/Auth/AuthGate';
import AccountBar from './Components/Auth/AccountBar';




function App() {


  useEffect(() => {

    ReactGA.initialize("G-RJKTMZ8CGB");
    ReactGA.send({
      hitType: "pageview", 
      page: window.location.pathname, 
      title: "App.jsx"
    });

  }, []);

  return (
    <AuthProvider>
      <AuthGate>
        <div>
          <AccountBar/>
          <AnalyticsDisclosure/>
          <QueryFields/>
        </div>
      </AuthGate>
    </AuthProvider>
  );
};

export default App;
