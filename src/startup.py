from __future__ import annotations
import ctypes
from ctypes import wintypes
import sys
import tkinter as tk
import webview
from PIL import Image, ImageDraw, ImageOps, ImageTk
from src.config import (
    APP_ICON_PATH,
    APP_FULL_NAME,
    LIGHT_LOGO_PATH,
    SPLASH_LOGO_PATH,
    UI_INDEX_PATH,
    WINDOW_DEFAULT_HEIGHT,
    WINDOW_DEFAULT_WIDTH,
    WINDOW_MIN_HEIGHT,
    WINDOW_MIN_WIDTH,
    WINDOW_TITLE,
)
# ============================================================
# WINDOWS / DPI
# ============================================================
def enable_dpi_awareness() -> None:
    """
    Improve rendering on high-DPI Windows displays.
    """
    if sys.platform != "win32":
        return
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(2)
        return
    except Exception:
        pass
    try:
        ctypes.windll.user32.SetProcessDPIAware()
    except Exception:
        pass
def refresh_app_icon_from_brand() -> None:
    """
    Refresh the Windows ICO only when the source PNG is newer.

    The previous implementation rebuilt every icon size on every launch.
    Avoiding that repeated image work keeps startup lighter on slower PCs.
    """
    if not LIGHT_LOGO_PATH.exists():
        return

    try:
        if (
            APP_ICON_PATH.exists()
            and APP_ICON_PATH.stat().st_mtime_ns
            >= LIGHT_LOGO_PATH.stat().st_mtime_ns
        ):
            return
    except OSError:
        pass

    try:
        source = Image.open(LIGHT_LOGO_PATH).convert("RGBA")

        side = max(source.width, source.height)
        square = Image.new(
            "RGBA",
            (side, side),
            (0, 0, 0, 0),
        )
        square.alpha_composite(
            source,
            (
                (side - source.width) // 2,
                (side - source.height) // 2,
            ),
        )

        icon_image = ImageOps.contain(
            square,
            (256, 256),
            Image.Resampling.LANCZOS,
        )

        APP_ICON_PATH.parent.mkdir(
            parents=True,
            exist_ok=True,
        )
        icon_image.save(
            APP_ICON_PATH,
            format="ICO",
            sizes=[
                (16, 16),
                (24, 24),
                (32, 32),
                (48, 48),
                (64, 64),
                (128, 128),
                (256, 256),
            ],
        )
    except Exception:
        # Branding refresh must never block application startup.
        pass


def set_windows_app_identity() -> None:
    """Give CVM its own Windows taskbar identity."""
    if sys.platform != "win32":
        return
    try:
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(
            f"Farouk.{APP_FULL_NAME.replace(' ', '')}"
        )
    except Exception:
        pass
def apply_windows_window_icon(title: str) -> None:
    """Apply the CVM ICO to the main native window and taskbar."""
    if sys.platform != "win32" or not APP_ICON_PATH.exists():
        return
    try:
        user32 = ctypes.windll.user32
        IMAGE_ICON = 1
        LR_LOADFROMFILE = 0x0010
        WM_SETICON = 0x0080
        ICON_SMALL = 0
        ICON_BIG = 1
        hwnd = user32.FindWindowW(None, title)
        if not hwnd:
            current_pid = ctypes.windll.kernel32.GetCurrentProcessId()
            matches = []
            enum_proc_type = ctypes.WINFUNCTYPE(
                ctypes.c_bool,
                wintypes.HWND,
                wintypes.LPARAM,
            )
            def enum_proc(candidate, _lparam):
                process_id = wintypes.DWORD()
                user32.GetWindowThreadProcessId(
                    candidate,
                    ctypes.byref(process_id),
                )
                if (
                    process_id.value == current_pid
                    and user32.IsWindowVisible(candidate)
                ):
                    matches.append(candidate)
                return True
            user32.EnumWindows(
                enum_proc_type(enum_proc),
                0,
            )
            if matches:
                hwnd = matches[-1]
        if not hwnd:
            return
        big_icon = user32.LoadImageW(
            None,
            str(APP_ICON_PATH),
            IMAGE_ICON,
            64,
            64,
            LR_LOADFROMFILE,
        )
        small_icon = user32.LoadImageW(
            None,
            str(APP_ICON_PATH),
            IMAGE_ICON,
            32,
            32,
            LR_LOADFROMFILE,
        )
        if big_icon:
            user32.SendMessageW(hwnd, WM_SETICON, ICON_BIG, big_icon)
        if small_icon:
            user32.SendMessageW(hwnd, WM_SETICON, ICON_SMALL, small_icon)
    except Exception:
        pass
# ============================================================
# MONITOR DETECTION
# ============================================================
class RECT(ctypes.Structure):
    _fields_ = [
        ("left", ctypes.c_long),
        ("top", ctypes.c_long),
        ("right", ctypes.c_long),
        ("bottom", ctypes.c_long),
    ]
class MONITORINFO(ctypes.Structure):
    _fields_ = [
        ("cbSize", wintypes.DWORD),
        ("rcMonitor", RECT),
        ("rcWork", RECT),
        ("dwFlags", wintypes.DWORD),
    ]
def _fallback_monitor() -> dict:
    root = tk.Tk()
    root.withdraw()
    width = root.winfo_screenwidth()
    height = root.winfo_screenheight()
    root.destroy()
    return {
        "left": 0,
        "top": 0,
        "right": width,
        "bottom": height,
        "width": width,
        "height": height,
        "primary": True,
    }
def _get_windows_monitors() -> list[dict]:
    if sys.platform != "win32":
        return []
    user32 = ctypes.windll.user32
    monitors: list[dict] = []
    callback_type = ctypes.WINFUNCTYPE(
        ctypes.c_int,
        wintypes.HMONITOR,
        wintypes.HDC,
        ctypes.POINTER(RECT),
        wintypes.LPARAM,
    )
    def callback(
        hmonitor,
        _hdc,
        _rect,
        _lparam,
    ):
        info = MONITORINFO()
        info.cbSize = ctypes.sizeof(
            MONITORINFO
        )
        user32.GetMonitorInfoW(
            hmonitor,
            ctypes.byref(info),
        )
        width = (
            info.rcWork.right
            - info.rcWork.left
        )
        height = (
            info.rcWork.bottom
            - info.rcWork.top
        )
        monitors.append(
            {
                "left": info.rcWork.left,
                "top": info.rcWork.top,
                "right": info.rcWork.right,
                "bottom": info.rcWork.bottom,
                "width": width,
                "height": height,
                "primary": bool(
                    info.dwFlags & 1
                ),
            }
        )
        return 1
    user32.EnumDisplayMonitors(
        0,
        0,
        callback_type(callback),
        0,
    )
    return monitors
def choose_target_monitor() -> dict:
    """
    CVM monitor behavior:
    - Laptop only -> use laptop.
    - External monitor present -> use largest secondary.
    """
    try:
        monitors = _get_windows_monitors()
        if not monitors:
            return _fallback_monitor()
        secondary = [
            monitor
            for monitor in monitors
            if not monitor["primary"]
        ]
        if secondary:
            return max(
                secondary,
                key=lambda monitor: (
                    monitor["width"]
                    * monitor["height"]
                ),
            )
        return monitors[0]
    except Exception:
        return _fallback_monitor()
# ============================================================
# SPLASH SCREEN
# ============================================================
def _splash_geometry(
    monitor: dict,
    width: int,
    height: int,
) -> str:
    x = (
        monitor["left"]
        + (
            monitor["width"]
            - width
        )
        // 2
    )
    y = (
        monitor["top"]
        + (
            monitor["height"]
            - height
        )
        // 2
    )
    return (
        f"{width}x{height}"
        f"+{x}+{y}"
    )
def _build_rounded_splash_image(
    width: int,
    height: int,
    radius: int,
    transparent_key: str,
) -> Image.Image:
    """
    Build the splash as a single Pillow image with rounded corners.
    The area outside the rounded rectangle uses the Windows
    transparent-color key.
    """
    key_rgb = tuple(
        int(
            transparent_key[i:i + 2],
            16,
        )
        for i in (
            1,
            3,
            5,
        )
    )
    canvas = Image.new(
        "RGB",
        (
            width,
            height,
        ),
        key_rgb,
    )
    rounded_mask = Image.new(
        "L",
        (
            width,
            height,
        ),
        0,
    )
    mask_draw = ImageDraw.Draw(
        rounded_mask
    )
    mask_draw.rounded_rectangle(
        (
            0,
            0,
            width - 1,
            height - 1,
        ),
        radius=radius,
        fill=255,
    )
    splash_surface = Image.new(
        "RGB",
        (
            width,
            height,
        ),
        "#121720",
    )
    if SPLASH_LOGO_PATH.exists():
        try:
            wallpaper = Image.open(
                SPLASH_LOGO_PATH
            ).convert(
                "RGB"
            )
            splash_surface = ImageOps.fit(
                wallpaper,
                (
                    width,
                    height,
                ),
                method=Image.Resampling.LANCZOS,
                centering=(
                    0.5,
                    0.5,
                ),
            )
        except Exception:
            pass
    canvas.paste(
        splash_surface,
        (
            0,
            0,
        ),
        rounded_mask,
    )
    return canvas
def show_splash(
    monitor: dict,
    duration_ms: int = 1200,
) -> None:
    """
    Rounded native CVM splash screen.
    Uses the full-bleed branded wallpaper:
        assets/branding/cvm_bg.png
    """
    splash_width = 680
    splash_height = 390
    corner_radius = 28
    # Very unusual color used only as the transparent window key.
    transparent_key = "#FF00FF"
    root = tk.Tk()
    root.overrideredirect(
        True
    )
    root.resizable(
        False,
        False,
    )
    root.configure(
        bg=transparent_key,
    )
    root.attributes(
        "-topmost",
        True,
    )
    root.geometry(
        _splash_geometry(
            monitor,
            splash_width,
            splash_height,
        )
    )
    # --------------------------------------------------------
    # Transparent rounded window on Windows
    # --------------------------------------------------------
    if sys.platform == "win32":
        try:
            root.wm_attributes(
                "-transparentcolor",
                transparent_key,
            )
        except Exception:
            pass
    # --------------------------------------------------------
    # Canvas
    # --------------------------------------------------------
    canvas = tk.Canvas(
        root,
        width=splash_width,
        height=splash_height,
        bg=transparent_key,
        highlightthickness=0,
        borderwidth=0,
    )
    canvas.pack(
        fill="both",
        expand=True,
    )
    splash_image = _build_rounded_splash_image(
        splash_width,
        splash_height,
        corner_radius,
        transparent_key,
    )
    photo_reference = ImageTk.PhotoImage(
        splash_image
    )
    canvas.create_image(
        0,
        0,
        anchor="nw",
        image=photo_reference,
    )
    # Keep reference alive.
    canvas._cvm_splash_photo = (
        photo_reference
    )
    # --------------------------------------------------------
    # Loading track
    # --------------------------------------------------------
    track_margin = 26
    track_left = (
        track_margin
    )
    track_right = (
        splash_width
        - track_margin
    )
    track_top = (
        splash_height
        - 12
    )
    track_bottom = (
        splash_height
        - 7
    )
    track_radius = 3
    canvas.create_rounded_rectangle = (
        lambda x1,
               y1,
               x2,
               y2,
               radius,
               **kwargs:
        _canvas_rounded_rectangle(
            canvas,
            x1,
            y1,
            x2,
            y2,
            radius,
            **kwargs,
        )
    )
    canvas.create_rounded_rectangle(
        track_left,
        track_top,
        track_right,
        track_bottom,
        track_radius,
        fill="#2B303A",
        outline="",
    )
    loading_bar = (
        canvas.create_rounded_rectangle(
            track_left,
            track_top,
            track_left + 4,
            track_bottom,
            track_radius,
            fill="#D0AA70",
            outline="",
        )
    )
    # --------------------------------------------------------
    # Animation
    # --------------------------------------------------------
    steps = 90
    interval = max(
        10,
        duration_ms // steps,
    )
    usable_width = (
        track_right
        - track_left
    )
    def animate(
        step: int = 0,
    ) -> None:
        progress = (
            step
            / steps
        )
        current_right = (
            track_left
            + max(
                4,
                int(
                    usable_width
                    * progress
                ),
            )
        )
        canvas.coords(
            loading_bar,
            *_rounded_rectangle_points(
                track_left,
                track_top,
                current_right,
                track_bottom,
                track_radius,
            ),
        )
        if step < steps:
            root.after(
                interval,
                animate,
                step + 1,
            )
    animate()
    root.after(
        duration_ms,
        root.destroy,
    )
    root.mainloop()
def _rounded_rectangle_points(
    x1: float,
    y1: float,
    x2: float,
    y2: float,
    radius: float,
) -> list[float]:
    """
    Return points for a smooth rounded rectangle polygon.
    """
    radius = max(
        0,
        min(
            radius,
            (
                x2
                - x1
            )
            / 2,
            (
                y2
                - y1
            )
            / 2,
        ),
    )
    return [
        x1 + radius,
        y1,
        x2 - radius,
        y1,
        x2,
        y1,
        x2,
        y1 + radius,
        x2,
        y2 - radius,
        x2,
        y2,
        x2 - radius,
        y2,
        x1 + radius,
        y2,
        x1,
        y2,
        x1,
        y2 - radius,
        x1,
        y1 + radius,
        x1,
        y1,
        x1 + radius,
        y1,
    ]
def _canvas_rounded_rectangle(
    canvas: tk.Canvas,
    x1: float,
    y1: float,
    x2: float,
    y2: float,
    radius: float,
    **kwargs,
):
    """
    Draw a smooth rounded rectangle on a Tkinter Canvas.
    """
    points = _rounded_rectangle_points(
        x1,
        y1,
        x2,
        y2,
        radius,
    )
    return canvas.create_polygon(
        points,
        smooth=True,
        splinesteps=36,
        **kwargs,
    )
# ============================================================
# APPLICATION STARTUP
# ============================================================
def launch_application(
    bridge,
) -> None:
    enable_dpi_awareness()
    refresh_app_icon_from_brand()
    set_windows_app_identity()
    monitor = choose_target_monitor()
    show_splash(
        monitor
    )
    ui_url = (
        UI_INDEX_PATH
        .resolve()
        .as_uri()
    )
    width = max(
        WINDOW_DEFAULT_WIDTH,
        min(
            monitor["width"],
            WINDOW_DEFAULT_WIDTH,
        ),
    )
    height = max(
        WINDOW_DEFAULT_HEIGHT,
        min(
            monitor["height"],
            WINDOW_DEFAULT_HEIGHT,
        ),
    )
    window = webview.create_window(
        WINDOW_TITLE,
        url=ui_url,
        js_api=bridge,
        hidden=True,
        x=monitor["left"],
        y=monitor["top"],
        width=width,
        height=height,
        min_size=(
            WINDOW_MIN_WIDTH,
            WINDOW_MIN_HEIGHT,
        ),
        background_color="#FFFFFF",
    )
    bridge.set_window(
        window
    )
    # CVM 0.5: block accidental close while a change is still dirty.
    # The UI receives a custom confirmation modal instead of a Windows MessageBox.
    def on_closing():
        try:
            if bridge.can_close():
                return True
            bridge._call_js("cvmRequestCloseConfirmation")
            return False
        except Exception:
            return True
    try:
        window.events.closing += on_closing
    except Exception:
        pass
    def after_start():
        try:
            window.show()
        except Exception:
            pass
        try:
            window.maximize()
        except Exception:
            pass
        try:
            apply_windows_window_icon(WINDOW_TITLE)
        except Exception:
            pass
    webview.start(
        after_start,
        debug=False,
    )
