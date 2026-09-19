using System.Collections.Concurrent;
using System.Drawing.Drawing2D;

namespace Kendirov.KirillDeviceHub;

internal static class OverlayManager
{
    private static readonly object Gate = new();
    private static Thread? uiThread;
    private static Control? dispatcher;
    private static readonly ManualResetEventSlim Ready = new(false);

    public static void Initialize() => EnsureUiThread();

    public static void Show(string text, int seconds, string mode = "card")
    {
        EnsureUiThread();
        dispatcher!.BeginInvoke(new Action(() =>
        {
            var form = new FancyOverlayForm(text, Math.Clamp(seconds, 1, 24 * 60 * 60), mode);
            form.Show();
        }));
    }

    public static void StartTimer(int minutes, string text, string endAction)
    {
        minutes = Math.Clamp(minutes, 1, 24 * 60);
        var label = string.IsNullOrWhiteSpace(text) ? "Осталось времени" : "Осталось времени — " + text;
        EnsureUiThread();
        dispatcher!.BeginInvoke(new Action(() =>
        {
            var form = new FancyOverlayForm(label, minutes * 60, "timer", endAction);
            form.Show();
        }));
    }

    private static void EnsureUiThread()
    {
        lock (Gate)
        {
            if (uiThread is { IsAlive: true } && dispatcher is not null) return;

            Ready.Reset();
            uiThread = new Thread(() =>
            {
                dispatcher = new Control();
                dispatcher.CreateControl();
                Ready.Set();
                Application.Run();
                dispatcher.Dispose();
                dispatcher = null;
            });
            uiThread.Name = "KendirovOverlayUI";
            uiThread.IsBackground = true;
            uiThread.SetApartmentState(ApartmentState.STA);
            uiThread.Start();
        }
        Ready.Wait(TimeSpan.FromSeconds(5));
    }
}

internal sealed class FancyOverlayForm : Form
{
    private readonly System.Windows.Forms.Timer timer;
    private readonly System.Windows.Forms.Timer anim;
    private readonly Label title;
    private readonly Label subtitle;
    private readonly Label hint;
    private readonly Label countdown;
    private readonly Button okButton;
    private readonly Button laterButton;
    private int remaining;
    private readonly string endAction;
    private float steamPhase;

    public FancyOverlayForm(string text, int seconds, string mode, string endAction = "none")
    {
        remaining = seconds;
        this.endAction = endAction;

        FormBorderStyle = FormBorderStyle.None;
        StartPosition = FormStartPosition.Manual;
        ShowInTaskbar = false;
        TopMost = true;
        DoubleBuffered = true;
        BackColor = Color.FromArgb(18, 20, 32);
        ForeColor = Color.White;
        Width = 570;
        Height = mode.Equals("fullscreen", StringComparison.OrdinalIgnoreCase) ? 360 : 300;

        var wa = Screen.PrimaryScreen?.WorkingArea ?? new Rectangle(0, 0, 1920, 1080);
        Location = mode.Equals("fullscreen", StringComparison.OrdinalIgnoreCase)
            ? new Point(wa.Left + (wa.Width - Width) / 2, wa.Top + (wa.Height - Height) / 2)
            : new Point(wa.Right - Width - 28, wa.Top + 28);

        title = new Label
        {
            AutoSize = false,
            Location = new Point(118, 34),
            Size = new Size(420, 48),
            Font = new Font("Segoe UI", 24, FontStyle.Bold),
            ForeColor = Color.White,
            BackColor = Color.Transparent,
            Text = text.Split('\n')[0],
            TextAlign = ContentAlignment.MiddleLeft
        };

        var lines = text.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        subtitle = new Label
        {
            AutoSize = false,
            Location = new Point(120, 82),
            Size = new Size(410, 54),
            Font = new Font("Segoe UI", 14, FontStyle.Bold),
            ForeColor = Color.FromArgb(255, 228, 157),
            BackColor = Color.Transparent,
            Text = lines.Length > 1 ? string.Join(" ", lines.Skip(1)) : "Горячие пельмешки уже ждут тебя ♨",
            TextAlign = ContentAlignment.MiddleLeft
        };

        hint = new Label
        {
            AutoSize = false,
            Location = new Point(34, 156),
            Size = new Size(500, 34),
            Font = new Font("Segoe UI", 11, FontStyle.Regular),
            ForeColor = Color.FromArgb(224, 229, 255),
            BackColor = Color.Transparent,
            Text = "🔥 горячие пельмешки   •   ⚡ энергия +100   •   🎮 игра подождёт",
            TextAlign = ContentAlignment.MiddleCenter
        };

        countdown = new Label
        {
            AutoSize = false,
            Location = new Point(32, 194),
            Size = new Size(504, 24),
            Font = new Font("Segoe UI", 10, FontStyle.Bold),
            ForeColor = Color.FromArgb(186, 197, 255),
            BackColor = Color.Transparent,
            TextAlign = ContentAlignment.MiddleCenter
        };

        okButton = new Button
        {
            Text = "🥟  ОК, ИДУ!",
            Location = new Point(35, 232),
            Size = new Size(238, 44),
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.FromArgb(55, 214, 122),
            ForeColor = Color.White,
            Font = new Font("Segoe UI", 12, FontStyle.Bold),
            TabStop = false
        };
        okButton.FlatAppearance.BorderSize = 0;
        okButton.Click += (_, _) => Close();

        laterButton = new Button
        {
            Text = "ЕЩЁ 5 МИНУТ",
            Location = new Point(292, 232),
            Size = new Size(238, 44),
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.FromArgb(63, 58, 86),
            ForeColor = Color.White,
            Font = new Font("Segoe UI", 11, FontStyle.Bold),
            TabStop = false
        };
        laterButton.FlatAppearance.BorderSize = 0;
        laterButton.Click += (_, _) =>
        {
            remaining = Math.Max(remaining, 300);
            hint.Text = "Хорошо 🙂 Напомню ещё раз через 5 минут";
        };

        Controls.AddRange(new Control[] { title, subtitle, hint, countdown, okButton, laterButton });

        timer = new System.Windows.Forms.Timer { Interval = 1000 };
        timer.Tick += (_, _) => TickSecond();
        timer.Start();

        anim = new System.Windows.Forms.Timer { Interval = 55 };
        anim.Tick += (_, _) => { steamPhase += 0.16f; Invalidate(new Rectangle(24, 24, 95, 125)); };
        anim.Start();

        UpdateTime();
    }

    protected override bool ShowWithoutActivation => true;

    protected override CreateParams CreateParams
    {
        get
        {
            const int WS_EX_TOOLWINDOW = 0x00000080;
            const int WS_EX_NOACTIVATE = 0x08000000;
            var cp = base.CreateParams;
            cp.ExStyle |= WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE;
            return cp;
        }
    }

    protected override void OnShown(EventArgs e)
    {
        base.OnShown(e);
        Native.SetWindowPos(Handle, Native.HWND_TOPMOST, 0, 0, 0, 0,
            Native.SWP_NOMOVE | Native.SWP_NOSIZE | Native.SWP_NOACTIVATE | Native.SWP_SHOWWINDOW);
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;

        using var path = RoundedRect(new RectangleF(2, 2, Width - 5, Height - 5), 26);
        using var grad = new LinearGradientBrush(ClientRectangle,
            Color.FromArgb(247, 25, 15, 39),
            Color.FromArgb(247, 15, 25, 53),
            LinearGradientMode.ForwardDiagonal);
        e.Graphics.FillPath(grad, path);

        using var border = new Pen(Color.FromArgb(255, 175, 64), 3);
        e.Graphics.DrawPath(border, path);

        // Dumpling bowl
        using var bowl = new SolidBrush(Color.FromArgb(245, 244, 210, 139));
        e.Graphics.FillEllipse(bowl, 30, 54, 76, 58);
        using var dumpling = new SolidBrush(Color.FromArgb(255, 235, 170, 95));
        for (int i = 0; i < 4; i++)
            e.Graphics.FillEllipse(dumpling, 36 + i * 15, 58 + (i % 2) * 6, 23, 18);

        // Animated steam
        using var steamPen = new Pen(Color.FromArgb(150, 255, 248, 225), 4)
        { StartCap = LineCap.Round, EndCap = LineCap.Round };
        for (int i = 0; i < 3; i++)
        {
            var x = 47 + i * 20;
            var y = 47 - (float)(Math.Sin(steamPhase + i) * 5);
            e.Graphics.DrawBezier(steamPen, x, y, x - 7, y - 14, x + 9, y - 22, x + 1, y - 38);
        }
    }

    private void TickSecond()
    {
        remaining--;
        UpdateTime();
        if (remaining > 0) return;

        timer.Stop();
        if (endAction.Equals("lock", StringComparison.OrdinalIgnoreCase))
            Native.LockWorkStation();
        Close();
    }

    private void UpdateTime()
    {
        var ts = TimeSpan.FromSeconds(Math.Max(0, remaining));
        countdown.Text = remaining >= 300
            ? "Сообщение от папы • можно закрыть кнопкой"
            : "Исчезнет через " + ts.ToString(@"mm\:ss");
    }

    private static GraphicsPath RoundedRect(RectangleF r, float radius)
    {
        var p = new GraphicsPath();
        var d = radius * 2;
        p.AddArc(r.Left, r.Top, d, d, 180, 90);
        p.AddArc(r.Right - d, r.Top, d, d, 270, 90);
        p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
        p.AddArc(r.Left, r.Bottom - d, d, d, 90, 90);
        p.CloseFigure();
        return p;
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            timer.Dispose();
            anim.Dispose();
        }
        base.Dispose(disposing);
    }
}
