"use client";

import { LockOutlined, LoginOutlined, UserOutlined } from "@ant-design/icons";
import { Alert, Button, Checkbox, Input } from "antd";

export default function BrioLoginForm({ hasError }: { hasError: boolean }) {
  return (
    <form action="/api/brio-login" method="post" className="login-form">
      <label>
        Usuario de Neptunia
        <Input name="username" prefix={<UserOutlined />} required autoComplete="username" placeholder="Tu usuario del club" size="large" />
      </label>
      <label>
        Contraseña de Neptunia
        <Input.Password name="password" prefix={<LockOutlined />} required autoComplete="current-password" placeholder="Tu contraseña del club" size="large" />
      </label>
      <Checkbox name="enableAutomations" value="true">Habilitar reservas automáticas con esta cuenta</Checkbox>
      {hasError ? <Alert message="Neptunia rechazó el usuario o la contraseña" type="error" showIcon /> : null}
      <Button type="primary" htmlType="submit" size="large" icon={<LoginOutlined />} iconPosition="end" block>
        Conectar con Neptunia
      </Button>
    </form>
  );
}
