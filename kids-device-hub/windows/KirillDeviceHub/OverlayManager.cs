namespace Kendirov.KirillDeviceHub;

internal static class OverlayManager
{
    private static readonly object Gate=new();
    private static OverlayForm? current;

    public static void Show(string text,int seconds,string mode="card")
    {
        seconds=Math.Clamp(seconds,1,24*60*60);
        if(Application.OpenForms.Count==0) return;

        void Create()
        {
            lock(Gate)
            {
                try{ current?.Close(); }catch{}
                current=new OverlayForm(text,seconds,mode);
                current.Show();
            }
        }

        var form=Application.OpenForms.Cast<Form>().FirstOrDefault();
        if(form!=null && form.InvokeRequired) form.BeginInvoke((Action)Create); else Create();
    }

    public static void StartTimer(int minutes,string text,string endAction)
    {
        minutes=Math.Clamp(minutes,1,24*60);
        var seconds=minutes*60;
        var label=string.IsNullOrWhiteSpace(text)?"Осталось времени":"Осталось времени — "+text;

        void Create()
        {
            lock(Gate)
            {
                try{ current?.Close(); }catch{}
                current=new OverlayForm(label,seconds,"timer",endAction);
                current.Show();
            }
        }

        var form=Application.OpenForms.Cast<Form>().FirstOrDefault();
        if(form!=null && form.InvokeRequired) form.BeginInvoke((Action)Create); else Create();
    }
}

internal sealed class OverlayForm:Form
{
    private readonly Label title;
    private readonly Label countdown;
    private readonly System.Windows.Forms.Timer timer;
    private int remaining;
    private readonly string endAction;

    public OverlayForm(string text,int seconds,string mode,string endAction="none")
    {
        remaining=seconds;
        this.endAction=endAction;

        FormBorderStyle=FormBorderStyle.None;
        TopMost=true;
        ShowInTaskbar=false;
        BackColor=Color.FromArgb(30,32,40);
        ForeColor=Color.White;
        StartPosition=FormStartPosition.Manual;

        if(mode.Equals("fullscreen",StringComparison.OrdinalIgnoreCase))
        {
            Bounds=SystemInformation.VirtualScreen;
            Opacity=0.96;
        }
        else
        {
            Width=520; Height=160;
            var wa=Screen.PrimaryScreen?.WorkingArea ?? new Rectangle(0,0,1920,1080);
            Location=new Point(wa.Right-Width-24,wa.Top+24);
            Opacity=0.94;
        }

        title=new Label{
            Text=text,AutoSize=false,Dock=DockStyle.Top,Height=82,
            Font=new Font("Segoe UI",18,FontStyle.Bold),
            TextAlign=ContentAlignment.MiddleCenter,ForeColor=Color.White
        };
        countdown=new Label{
            AutoSize=false,Dock=DockStyle.Fill,
            Font=new Font("Segoe UI",24,FontStyle.Bold),
            TextAlign=ContentAlignment.MiddleCenter,ForeColor=Color.White
        };

        Controls.Add(countdown); Controls.Add(title);
        timer=new System.Windows.Forms.Timer{Interval=1000};
        timer.Tick+=(_,_)=>Tick();
        UpdateTime();
        timer.Start();
    }

    private void Tick()
    {
        remaining--;
        UpdateTime();
        if(remaining>0) return;
        timer.Stop();

        if(endAction.Equals("lock",StringComparison.OrdinalIgnoreCase))
            Native.LockWorkStation();

        if(endAction.Equals("fullscreen",StringComparison.OrdinalIgnoreCase))
        {
            title.Text="Время на сегодня закончилось";
            countdown.Text="";
            Bounds=SystemInformation.VirtualScreen;
            Opacity=0.98;
            return;
        }

        Close();
    }

    private void UpdateTime()
    {
        var ts=TimeSpan.FromSeconds(Math.Max(0,remaining));
        countdown.Text=ts.TotalHours>=1?ts.ToString(@"hh\:mm\:ss"):ts.ToString(@"mm\:ss");
    }

    protected override void Dispose(bool disposing)
    {
        if(disposing) timer.Dispose();
        base.Dispose(disposing);
    }
}
