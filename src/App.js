import React from "react";
import ToolInventoryApp from "./ToolInventoryApp";

export default function App() {
  return <ToolInventoryApp />;
}

import React from "react";
import AuthGate from "./AuthGate";
import ToolInventoryApp from "./ToolInventoryApp";

export default function App() {
  return (
    <AuthGate>
      <ToolInventoryApp />
    </AuthGate>
  );
}
