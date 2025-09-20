using UnityEngine;
using UnityEngine.SceneManagement;

namespace SoyuzmultparkAR.Test
{
    public class SceneLoader : MonoBehaviour
    {
        private void Start()
        {
            DontDestroyOnLoad(gameObject);
        }

        public void LoadScene(int sceneIndex)
        {
            SceneManager.LoadScene(sceneIndex);
        }
    }
}