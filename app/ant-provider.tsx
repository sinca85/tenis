"use client";

import { App, ConfigProvider, theme } from "antd";
import esES from "antd/locale/es_ES";

export default function AntProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      locale={esES}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: "#f45b14",
          colorInfo: "#f45b14",
          colorSuccess: "#73a900",
          colorText: "#342218",
          colorTextSecondary: "#76675e",
          colorBgBase: "#fffaf3",
          colorBorder: "#eadfd3",
          borderRadius: 14,
          borderRadiusLG: 22,
          fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          controlHeight: 44,
        },
        components: {
          Button: { fontWeight: 700, primaryShadow: "none" },
          Input: { activeShadow: "0 0 0 3px rgba(244,91,20,.12)" },
          DatePicker: { activeShadow: "0 0 0 3px rgba(244,91,20,.12)" },
          Table: { headerBg: "transparent", rowHoverBg: "#fff7ed" },
        },
      }}
    >
      <App>{children}</App>
    </ConfigProvider>
  );
}
