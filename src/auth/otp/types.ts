/** 验证码下发渠道抽象（与 LLM provider 同构）：mock 离线、真实短信可插拔。 */
export interface OtpSender {
  readonly name: string;
  send(phone: string, code: string): Promise<void>;
}
