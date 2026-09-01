"use client";

import { LockOutlined, LoginOutlined, UserOutlined } from "@ant-design/icons";
import { Alert, Button, Input } from "antd";

export default function LoginForm({ hasError }: { hasError: boolean }) {
  return (
    <form action="/api/login" method="post" className="login-form">
      <label>
        Usuario
        <Input name="username" prefix={<UserOutlined />} required autoComplete="username" placeholder="Tu usuario" size="large" />
      </label>
      <label>
        Contraseña
        <Input.Password name="password" prefix={<LockOutlined />} required autoComplete="current-password" placeholder="Tu contraseña" size="large" />
      </label>
      {hasError ? <Alert message="Usuario o contraseña incorrectos" type="error" showIcon /> : null}
      <Button type="primary" htmlType="submit" size="large" icon={<LoginOutlined />} iconPosition="end" block>
        Ingresar
      </Button>
    </form>
  );
}
