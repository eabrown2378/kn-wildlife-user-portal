import QueryFields from './Components/QueryFields';
import * as analytics from './Functions/analytics';
import { readConsent, recordConsent } from './Functions/analytics_consent';
import './styles/App.css';
import { useCallback, useEffect, useState } from 'react';
import AnalyticsDisclosure from './Components/AnalyticsDisclosure';
import AuthProvider from './Components/Auth/AuthProvider';
import AuthGate from './Components/Auth/AuthGate';
import AccountBar from './Components/Auth/AccountBar';
import { AnalyticsConsentContext } from './Context/AnalyticsConsentContext';




function App() {

  // null until somebody has been asked. Analytics starts on consent, so nothing is sent to
  // Google before an answer, and a refusal is honoured for the rest of the visit.
  const [consent, setConsent] = useState(readConsent);

  useEffect(() => {
    if (consent === 'granted') analytics.start();
    else analytics.stop();
  }, [consent]);

  const decide = useCallback((choice) => {
    recordConsent(choice);
    setConsent(choice);
  }, []);

  // Offered from the footer so a decision can be changed without clearing site data.
  const reconsider = useCallback(() => setConsent(null), []);

  return (
    <AuthProvider>
      <AuthGate>
        <AnalyticsConsentContext.Provider value={{ consent, decide, reconsider }}>
          <div>
            <AccountBar/>
            {consent === null && <AnalyticsDisclosure onDecide={decide}/>}
            <QueryFields/>
          </div>
        </AnalyticsConsentContext.Provider>
      </AuthGate>
    </AuthProvider>
  );
};

export default App;
