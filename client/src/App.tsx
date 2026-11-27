import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { Provider } from 'react-redux';
import { queryClient } from '@/lib/queryClient';
import { reduxStore } from '@/store/redux/store';
import { router } from './router';

export function App() {
  return (
    <Provider store={reduxStore}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </Provider>
  );
}

export default App;
