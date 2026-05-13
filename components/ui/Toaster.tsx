"use client";

import { Toaster as Sonner } from "sonner";
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      position="bottom-right"
      icons={{
        success: <CheckCircle2 className="h-5 w-5 text-green-500" />,
        info: <Info className="h-5 w-5 text-blue-500" />,
        warning: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
        error: <AlertCircle className="h-5 w-5 text-red-500" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast font-body shadow-xl border border-cb-gray-200 bg-white text-cb-black rounded-xl p-4 transition-all",
          description: "text-cb-gray-500 text-sm mt-1",
          actionButton:
            "bg-cb-black text-white px-4 py-2 rounded-lg font-medium hover:bg-cb-gray-800 transition-colors",
          cancelButton:
            "bg-cb-gray-100 text-cb-gray-600 px-4 py-2 rounded-lg font-medium hover:bg-cb-gray-200 transition-colors",
          error: "group-[.toaster]:border-red-200 group-[.toaster]:bg-red-50",
          success: "group-[.toaster]:border-green-200 group-[.toaster]:bg-green-50",
          warning: "group-[.toaster]:border-yellow-200 group-[.toaster]:bg-yellow-50",
          info: "group-[.toaster]:border-blue-200 group-[.toaster]:bg-blue-50",
        },
      }}
      {...props}
    />
  );
};

export default Toaster;
