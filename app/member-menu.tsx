"use client";

import { DownOutlined, UserOutlined } from "@ant-design/icons";
import { App, Button, Dropdown } from "antd";
import { useState } from "react";

export type MemberOption = { socioId: string; name: string };

export default function MemberMenu({ currentId, members }: { currentId: string; members: MemberOption[] }) {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const current = members.find((member) => member.socioId === currentId) || members[0];

  const selectMember = async (socioId: string) => {
    if (socioId === currentId) return;
    setLoading(true);
    try {
      const response = await fetch("/api/brio-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socioId }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "No se pudo cambiar de socio");
      window.location.reload();
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : "No se pudo cambiar de socio");
      setLoading(false);
    }
  };

  return (
    <Dropdown
      disabled={loading}
      menu={{
        selectable: true,
        selectedKeys: [currentId],
        items: members.map((member) => ({ key: member.socioId, label: member.name, icon: <UserOutlined /> })),
        onClick: ({ key }) => void selectMember(key),
      }}
      trigger={["click"]}
    >
      <Button className="member-menu-button" type="text" loading={loading} icon={<UserOutlined />}>
        <span className="member-greeting">Hola, {current?.name || "Socio"}</span>{members.length > 1 ? <DownOutlined /> : null}
      </Button>
    </Dropdown>
  );
}
