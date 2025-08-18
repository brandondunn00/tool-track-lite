import AuthGate from "./AuthGate";
import ToolInventoryApp from "./ToolInventoryApp";

export default function App() {
  return (
    <AuthGate>
      <ToolInventoryApp />
    </AuthGate>
  );
}
