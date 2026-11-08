import { toast as sonner, Toaster } from 'sonner';

export interface ToastOptions {
  description?: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

const toSonner = (o?: ToastOptions) =>
  o && {
    description: o.description,
    duration: o.duration,
    action: o.action && { label: o.action.label, onClick: o.action.onClick },
  };

export class ToastPlugin {
  success(title: string, options?: ToastOptions) {
    return sonner.success(title, toSonner(options));
  }

  error(title: string, options?: ToastOptions) {
    return sonner.error(title, { duration: 7000, ...toSonner(options) });
  }

  info(title: string, options?: ToastOptions) {
    return sonner.info(title, toSonner(options));
  }

  warning(title: string, options?: ToastOptions) {
    return sonner.warning(title, toSonner(options));
  }

  promise<T>(
    task: Promise<T>,
    messages: {
      loading: string;
      success: string | ((v: T) => string);
      error: (e: unknown) => string;
    },
  ) {
    sonner.promise(task, messages);
    return task;
  }

  dismiss(id?: string | number) {
    sonner.dismiss(id);
  }
}

export const toast = new ToastPlugin();

export function ToastViewport({ theme }: { theme: 'light' | 'dark' | 'system' }) {
  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      closeButton
      visibleToasts={4}
      offset={20}
      toastOptions={{
        classNames: {
          toast:
            'group !rounded-lg !border-2 !border-black !bg-white !text-[#1e1e1e] !shadow-[3px_3px_0_#000] !font-sans !gap-3 !py-3.5 !pl-4 !border-l-[6px]',
          title: '!text-[14px] !font-semibold',
          description: '!text-[13px] !text-[#555]',
          success: '!border-l-[#2e9d55] [&_[data-icon]]:!text-[#2e9d55]',
          error: '!border-l-[#d93b2f] [&_[data-icon]]:!text-[#d93b2f]',
          warning: '!border-l-[#e3a008] [&_[data-icon]]:!text-[#e3a008]',
          info: '!border-l-[#2a78d6] [&_[data-icon]]:!text-[#2a78d6]',
          icon: '!size-5',
          closeButton:
            '!border-2 !border-black !bg-white !text-black hover:!bg-[#f2f2f2] !shadow-[1px_1px_0_#000]',
          actionButton: '!bg-primary !text-black !font-semibold !border-2 !border-black',
        },
      }}
    />
  );
}
