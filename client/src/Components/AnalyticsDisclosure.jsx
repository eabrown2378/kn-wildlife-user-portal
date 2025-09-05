import { useEffect, useState } from "react";

const AnalyticsDisclosure = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hasConfirmed = localStorage.getItem("gaConsentConfirmed");
    if (!hasConfirmed) {
      setVisible(true);
    }
  }, []);

  const handleConfirm = () => {
    localStorage.setItem("gaConsentConfirmed", "true");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        width: "100%",
        backgroundColor: "#333",
        color: "#fff",
        padding: "1em",
        textAlign: "center",
        zIndex: 1000,
      }}
    >
      <p style={{ margin: 0 }}>
        We use Google Analytics to collect basic usage data to help improve our
        website experience.
      </p>
      <button
        onClick={handleConfirm}
        style={{
          marginTop: "0.5em",
          padding: "0.5em 1em",
          backgroundColor: "#4CAF50",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        Confirm
      </button>
    </div>
  );
};

export default AnalyticsDisclosure;