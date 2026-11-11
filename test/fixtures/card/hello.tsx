import { createRoot } from 'react-dom/client';

function Hello(): React.ReactElement {
  return <p className="p-4 text-lg font-semibold text-emerald-700">Hello from a card</p>;
}

createRoot(document.getElementById('root') as HTMLElement).render(<Hello />);
// A string a naive inliner would break on.
console.log('</script> stays inside the script');
