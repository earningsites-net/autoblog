export default function Loading() {
  return (
    <div className="route-loading-overlay fixed inset-0 z-[120] grid place-items-center">
      <span className="route-loading-spinner block h-10 w-10 animate-spin rounded-full border-[3px] border-solid border-current border-t-transparent" />
    </div>
  );
}
