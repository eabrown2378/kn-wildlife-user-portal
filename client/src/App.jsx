import QueryFields from './Components/QueryFields';
import ReactGA from 'react-ga4';
import './styles/App.css';
import { useEffect } from 'react';
import AnalyticsDisclosure from './Components/AnalyticsDisclosure';




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
    <>
      <div>  
        <AnalyticsDisclosure/>
        <QueryFields/>
      </div>
    </>
  );
};

export default App;
