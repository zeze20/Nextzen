import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/gecmis")({
  component: HistoryLayout,
});

function HistoryLayout() {
  return <Outlet />;
}
